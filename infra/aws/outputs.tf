output "aws_account_id" {
  value = local.account_id
}

output "aws_region" {
  value = var.aws_region
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "public_base_url" {
  value = local.public_base_url
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "github_actions_variables" {
  value = {
    AWS_ROLE_ARN       = aws_iam_role.github_deploy.arn
    AWS_REGION         = var.aws_region
    AWS_ECR_REPOSITORY = aws_ecr_repository.app.name
    AWS_ECS_CLUSTER    = aws_ecs_cluster.main.name
    AWS_ECS_SERVICE    = aws_ecs_service.app.name
    AWS_PUBLIC_BASE_URL = local.public_base_url
  }
}

output "next_steps" {
  value = <<-EOT
    1) Push first image:
       aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app.repository_url}
       docker build -t ${aws_ecr_repository.app.repository_url}:latest .
       docker push ${aws_ecr_repository.app.repository_url}:latest
       aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.app.name} --force-new-deployment --region ${var.aws_region}

    2) Set GitHub repo variables from github_actions_variables output.

    3) Verify: curl -sS ${local.public_base_url}/api/health
       Privacy: ${local.public_base_url}/privacy
  EOT
}
