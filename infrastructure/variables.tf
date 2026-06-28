variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "dynamodb_table_name" {
  type    = string
  default = "aimorpho"
}

variable "s3_bucket_name" {
  type    = string
  default = "aimorpho-images"
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
}

variable "apple_iap" {
  type = object({
    key_id      = string
    issuer_id   = string
    private_key = string
    bundle_id   = string
  })
  sensitive = true
}

variable "google_play" {
  type = object({
    service_account_json = string
    package_name         = string
  })
  sensitive = true
}
