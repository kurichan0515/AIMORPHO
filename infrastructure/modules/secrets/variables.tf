variable "environment" { type = string }

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
}

variable "apple_iap" {
  type      = object({
    key_id      = string
    issuer_id   = string
    private_key = string
    bundle_id   = string
  })
  sensitive = true
}

variable "google_play" {
  type      = object({
    service_account_json = string
    package_name         = string
  })
  sensitive = true
}
