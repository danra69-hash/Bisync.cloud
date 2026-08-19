# Deploy Bisync.cloud to AWS (`bisync.ai`)

**Status:** Hosting cutover runbook. App remains cloud-agnostic (env connection strings).  
**Target architecture:** [`AWS_TARGET_ARCHITECTURE.md`](./AWS_TARGET_ARCHITECTURE.md)  
**Readiness gate:** [`AWS_MIGRATION_READINESS.md`](./AWS_MIGRATION_READINESS.md)

GCP Cloud Run stays available for demos. **Prod for `bisync.ai` is AWS.**

## What you get

| Piece | AWS service |
|---|---|
| Container image | **ECR** |
| API + SPA (same Docker image as GCP) | **ECS Fargate** behind **ALB** |
| Postgres | **RDS PostgreSQL** (Aurora later if needed) |
| Secrets | **Secrets Manager** (`DB_PASSWORD`) |
| HTTPS + DNS | **ACM** + **Route53** on `bisync.ai` |
| CI deploy | **GitHub Actions** → OIDC role (no long-lived keys) |

Default region: **`ap-southeast-1`** (Singapore).

## Prerequisites (your AWS account)

1. AWS account with billing enabled.
2. Domain **`bisync.ai`** in **Route53** (hosted zone). If DNS is elsewhere, create the hosted zone and update registrar NS records first.
3. Local tools (one-time bootstrap): `aws` CLI v2, Terraform ≥ 1.5, Docker.
4. GitHub repo admin access to set Actions variables.

You do **not** need to change application code for the first lift — the Production image already reads:

- `ConnectionStrings__*`
- `DB_PASSWORD`
- `App__PublicBaseUrl`
- `ASPNETCORE_URLS=http://+:8080`

## One-time bootstrap

```bash
# 1) Login
aws configure   # or SSO: aws sso login --profile bisync
export AWS_PROFILE=bisync
export AWS_REGION=ap-southeast-1

# 2) Confirm the hosted zone
aws route53 list-hosted-zones-by-name --dns-name bisync.ai.

# 3) Create GitHub OIDC + deploy role + print GitHub variables
./scripts/setup-github-aws-deploy.sh

# 4) Terraform (VPC, ECR, RDS, ALB, ECS, ACM, DNS)
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
# edit: aws_account_id, domain_name, github_org/repo if needed
terraform init
terraform plan
terraform apply
```

After apply, Terraform outputs:

- `ecr_repository_url`
- `alb_dns_name`
- `rds_endpoint`
- `ecs_cluster_name` / `ecs_service_name`
- GitHub variables to set (also printed by the setup script)

### GitHub repository variables

| Variable | Example |
|---|---|
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/bisync-github-deploy` |
| `AWS_REGION` | `ap-southeast-1` |
| `AWS_ECR_REPOSITORY` | `bisync-cloud` |
| `AWS_ECS_CLUSTER` | `bisync-cloud` |
| `AWS_ECS_SERVICE` | `bisync-cloud` |
| `AWS_PUBLIC_BASE_URL` | `https://bisync.ai` |

Optional: keep GCP deploy on `master` until cutover; use workflow **Deploy AWS** (`workflow_dispatch`) for the first AWS ship, then enable `push: master` in `.github/workflows/deploy-aws.yml`.

## First image + scale up

Terraform defaults `desired_count = 0` so ECS does not crash-loop before the first image exists.

```bash
# From repo root (after terraform apply created ECR)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-southeast-1
REPO=bisync-cloud
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

docker build -t "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest" .
docker push "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest"

aws ecs update-service \
  --cluster bisync-cloud \
  --service bisync-cloud \
  --desired-count 1 \
  --force-new-deployment
```

Or run **Actions → Deploy AWS → Run workflow** (sets desired count to 1).

## DNS (`bisync.ai`)

Terraform creates:

- ACM certificate (DNS validation in the hosted zone)
- Alias **A/AAAA** for `bisync.ai` (and optional `www`) → ALB

Propagation is usually minutes. Check:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://bisync.ai/api/health
curl -sS https://bisync.ai/privacy | head
```

Expect `200` and the Privacy Policy SPA.

## Database

RDS is created empty. On first boot the API runs schema ensure / seeders (same as Cloud Run).

To **copy data from GCP Cloud SQL**:

1. Take a logical dump: `pg_dump` of `bisync`, `bisync_archive`, `bisync_audit`, `bisync_tag_suggestions`.
2. Restore into RDS (same DB names).
3. Set `DB_PASSWORD` to the RDS master/app password in Secrets Manager (Terraform wires the secret into the task definition).
4. Smoke-test `/api/health`, login, and one RMS path before switching public DNS.

`CREATE DATABASE` for enterprise dedicated tenants requires the app DB user to have `CREATEDB` (Terraform grants this on the app role).

## Cutover checklist

- [ ] Terraform apply green in `ap-southeast-1`
- [ ] `/api/health` 200 on ALB HTTPS (or temporary ALB DNS)
- [ ] Privacy / EULA / DPA load (`/privacy`, `/eula`, `/dpa`)
- [ ] Login + Weissbrau (or pilot tenant) smoke
- [ ] Point `bisync.ai` at ALB (if not already via Terraform)
- [ ] Update store / marketing links to `https://bisync.ai/privacy`
- [ ] Keep GCP as fallback until 48h stable, then scale Cloud Run to zero if desired

## What this agent cannot do without your credentials

This Cloud Agent environment has **no AWS CLI credentials**. Bootstrap and `terraform apply` must run on your machine or a CI role you create with the setup script.

## Files

| Path | Purpose |
|---|---|
| `infra/aws/` | Terraform stack |
| `scripts/setup-github-aws-deploy.sh` | OIDC + IAM role for GitHub Actions |
| `.github/workflows/deploy-aws.yml` | Build → ECR → ECS rolling deploy |
| `docs/AWS_TARGET_ARCHITECTURE.md` | Long-term 5k-tenancy binding decisions |
| `docs/AWS_MIGRATION_READINESS.md` | App readiness vs AWS account work |
