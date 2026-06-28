resource "aws_secretsmanager_secret" "jwt" {
  name                    = "aimorpho/jwt-secret"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = jsonencode({ JWT_SECRET = var.jwt_secret })
}

resource "aws_secretsmanager_secret" "gemini" {
  name                    = "aimorpho/gemini-api-key"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_secretsmanager_secret_version" "gemini" {
  secret_id     = aws_secretsmanager_secret.gemini.id
  secret_string = jsonencode({ GEMINI_API_KEY = var.gemini_api_key })
}

resource "aws_secretsmanager_secret" "apple_iap" {
  name                    = "aimorpho/apple-iap"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_secretsmanager_secret_version" "apple_iap" {
  secret_id = aws_secretsmanager_secret.apple_iap.id
  secret_string = jsonencode({
    APPLE_KEY_ID      = var.apple_iap.key_id
    APPLE_ISSUER_ID   = var.apple_iap.issuer_id
    APPLE_PRIVATE_KEY = var.apple_iap.private_key
    APPLE_BUNDLE_ID   = var.apple_iap.bundle_id
  })
}

resource "aws_secretsmanager_secret" "google_play" {
  name                    = "aimorpho/google-play"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_secretsmanager_secret_version" "google_play" {
  secret_id = aws_secretsmanager_secret.google_play.id
  secret_string = jsonencode({
    GOOGLE_SERVICE_ACCOUNT_JSON = var.google_play.service_account_json
    GOOGLE_PACKAGE_NAME         = var.google_play.package_name
  })
}
