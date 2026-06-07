output "api_gateway_url" {
  value = module.api_gateway.invoke_url
}

output "dynamodb_table_name" {
  value = module.dynamodb.table_name
}

output "s3_bucket_name" {
  value = module.s3.bucket_name
}
