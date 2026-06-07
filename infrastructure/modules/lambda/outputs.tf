output "function_arns" {
  value = { for k, v in aws_lambda_function.functions : k => v.arn }
}
output "function_invoke_arns" {
  value = { for k, v in aws_lambda_function.functions : k => v.invoke_arn }
}
output "authorizer_invoke_arn" {
  value = aws_lambda_function.functions["authorizer"].invoke_arn
}
