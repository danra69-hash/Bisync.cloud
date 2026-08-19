data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_route53_zone" "main" {
  count        = var.hosted_zone_id == "" ? 1 : 0
  name         = "${var.domain_name}."
  private_zone = false
}

locals {
  account_id      = data.aws_caller_identity.current.account_id
  hosted_zone_id  = var.hosted_zone_id != "" ? var.hosted_zone_id : data.aws_route53_zone.main[0].zone_id
  public_base_url = var.public_base_url != "" ? var.public_base_url : "https://${var.domain_name}"
  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
}
