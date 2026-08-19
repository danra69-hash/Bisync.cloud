variable "aws_region" {
  type        = string
  description = "AWS region for the stack."
  default     = "ap-southeast-1"
}

variable "name_prefix" {
  type        = string
  description = "Resource name prefix."
  default     = "bisync-cloud"
}

variable "domain_name" {
  type        = string
  description = "Apex domain hosted in Route53 (e.g. bisync.ai)."
  default     = "bisync.ai"
}

variable "create_www_record" {
  type        = bool
  description = "Also alias www.<domain> to the ALB."
  default     = true
}

variable "hosted_zone_id" {
  type        = string
  description = "Optional Route53 hosted zone ID. Leave empty to look up by domain_name."
  default     = ""
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "desired_count" {
  type        = number
  description = "ECS service desired tasks (use 0 until the first image is pushed)."
  default     = 0
}

variable "task_cpu" {
  type    = number
  default = 1024
}

variable "task_memory" {
  type    = number
  default = 2048
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_allocated_storage" {
  type    = number
  default = 50
}

variable "db_name" {
  type    = string
  default = "bisync"
}

variable "db_username" {
  type    = string
  default = "bisync"
}

variable "github_org" {
  type        = string
  description = "GitHub org or user that owns the repo (OIDC trust)."
  default     = "danra69-hash"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name for OIDC trust."
  default     = "Bisync.cloud"
}

variable "image_tag" {
  type        = string
  description = "Initial container image tag in ECR (CI overwrites on deploy)."
  default     = "latest"
}

variable "public_base_url" {
  type        = string
  description = "App__PublicBaseUrl. Empty = https://<domain_name>."
  default     = ""
}
