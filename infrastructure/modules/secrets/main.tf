resource "aws_secretsmanager_secret" "jwt" {
  name                    = "yasrun/jwt-secret"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "yasrun" }
}

resource "aws_secretsmanager_secret" "gemini" {
  name                    = "yasrun/gemini-api-key"
  recovery_window_in_days = 7
  tags                    = { Environment = var.environment, Project = "yasrun" }
}
