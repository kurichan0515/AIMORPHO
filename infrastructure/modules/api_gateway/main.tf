resource "aws_api_gateway_rest_api" "aimorpho" {
  name = "aimorpho-api-${var.environment}"
  tags = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_api_gateway_authorizer" "jwt" {
  name                   = "jwt-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.aimorpho.id
  authorizer_uri         = var.authorizer_invoke_arn
  type                   = "TOKEN"
  identity_source        = "method.request.header.Authorization"
  authorizer_result_ttl_in_seconds = 300
}

locals {
  routes = {
    "POST /auth/register"         = { fn = "fn-auth",   auth = false }
    "POST /auth/login"            = { fn = "fn-auth",   auth = false }
    "POST /auth/refresh"          = { fn = "fn-auth",   auth = false }
    "POST /auth/logout"           = { fn = "fn-auth",   auth = false }
    "GET /users/me"               = { fn = "fn-user",   auth = true  }
    "PUT /users/me"               = { fn = "fn-user",   auth = true  }
    "GET /users/me/goal"          = { fn = "fn-user",   auth = true  }
    "POST /users/me/goal"         = { fn = "fn-user",   auth = true  }
    "GET /users/me/streak"        = { fn = "fn-user",   auth = true  }
    "GET /users/me/badges"        = { fn = "fn-user",   auth = true  }
    "GET /avatar/upload-url"      = { fn = "fn-avatar", auth = true  }
    "POST /avatar/generate"       = { fn = "fn-avatar", auth = true  }
    "PUT /avatar/state"           = { fn = "fn-avatar", auth = true  }
    "POST /logs/weight"           = { fn = "fn-log",    auth = true  }
    "GET /logs/weight"            = { fn = "fn-log",    auth = true  }
    "GET /logs/meal/upload-url"   = { fn = "fn-meal",   auth = true  }
    "POST /logs/meal"             = { fn = "fn-meal",   auth = true  }
    "GET /logs/meal"              = { fn = "fn-meal",   auth = true  }
    "POST /logs/exercise"         = { fn = "fn-log",    auth = true  }
    "GET /logs/exercise"          = { fn = "fn-log",    auth = true  }
    "GET /ai/daily-advice"        = { fn = "fn-ai",     auth = true  }
    "POST /ai/penalty-event"      = { fn = "fn-ai",     auth = true  }
    "GET /ai/goal-message"        = { fn = "fn-ai",     auth = true  }
    "POST /groups"                = { fn = "fn-social", auth = true  }
    "POST /groups/join"           = { fn = "fn-social", auth = true  }
  }
}

resource "aws_api_gateway_deployment" "aimorpho" {
  rest_api_id = aws_api_gateway_rest_api.aimorpho.id
  triggers = {
    redeployment = sha1(jsonencode(aws_api_gateway_rest_api.aimorpho.body))
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.aimorpho.id
  rest_api_id   = aws_api_gateway_rest_api.aimorpho.id
  stage_name    = var.environment
}
