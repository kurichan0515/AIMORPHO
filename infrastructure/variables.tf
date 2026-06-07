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
  default = "yasrun"
}

variable "s3_bucket_name" {
  type    = string
  default = "yasrun-images"
}
