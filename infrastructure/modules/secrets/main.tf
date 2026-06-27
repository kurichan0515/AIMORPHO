resource "aws_secretsmanager_secret" "jwt" {
  name                    = "aimorpho/jwt-secret"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_secretsmanager_secret" "gemini" {
  name                    = "aimorpho/gemini-api-key"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_secretsmanager_secret" "apple_iap" {
  name                    = "aimorpho/apple-iap"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_secretsmanager_secret" "google_play" {
  name                    = "aimorpho/google-play"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "aimorpho" }
}
