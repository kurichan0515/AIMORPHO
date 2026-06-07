output "bucket_arn"             { value = aws_s3_bucket.images.arn }
output "bucket_name"            { value = aws_s3_bucket.images.id }
output "lambda_code_bucket"     { value = aws_s3_bucket.lambda_code.id }
output "lambda_code_bucket_arn" { value = aws_s3_bucket.lambda_code.arn }
