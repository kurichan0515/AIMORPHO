variable "environment"              { type = string }
variable "aws_region"               { type = string }
variable "lambda_functions"         { type = map(string) }
variable "lambda_invoke_arns"       { type = map(string) }
variable "authorizer_invoke_arn"    { type = string }
