#!/usr/bin/env bash
# One-time: GitHub Actions OIDC provider + deploy role for Bisync → AWS.
# Prefer owning this via Terraform (infra/aws/github_oidc.tf). Use this script
# only if you need the role before the first terraform apply.
#
# Usage:
#   export AWS_PROFILE=bisync
#   ./scripts/setup-github-aws-deploy.sh
#
# Optional env:
#   AWS_REGION=ap-southeast-1
#   NAME_PREFIX=bisync-cloud
#   GITHUB_ORG=danra69-hash
#   GITHUB_REPO=Bisync.cloud

set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-1}"
NAME_PREFIX="${NAME_PREFIX:-bisync-cloud}"
GITHUB_ORG="${GITHUB_ORG:-danra69-hash}"
GITHUB_REPO="${GITHUB_REPO:-Bisync.cloud}"
ROLE_NAME="${NAME_PREFIX}-github-deploy"
OIDC_URL="https://token.actions.githubusercontent.com"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Account: ${ACCOUNT_ID}"
echo "Region:  ${REGION}"
echo "Repo:    ${GITHUB_ORG}/${GITHUB_REPO}"

OIDC_ARN="$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn | [0]" --output text)"
if [[ -z "${OIDC_ARN}" || "${OIDC_ARN}" == "None" ]]; then
  echo "Creating GitHub OIDC provider..."
  # GitHub Actions OIDC root CA thumbprint (AWS docs / widely used).
  OIDC_ARN="$(aws iam create-open-id-connect-provider \
    --url "${OIDC_URL}" \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
    --query OpenIDConnectProviderArn --output text)"
  echo "OIDC provider: ${OIDC_ARN}"
else
  echo "OIDC provider exists: ${OIDC_ARN}"
fi

TRUST="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${OIDC_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF
)"

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "Updating trust on ${ROLE_NAME}..."
  aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document "${TRUST}"
else
  echo "Creating role ${ROLE_NAME}..."
  aws iam create-role --role-name "${ROLE_NAME}" --assume-role-policy-document "${TRUST}" >/dev/null
fi

POLICY="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "EcrPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages"
      ],
      "Resource": "arn:aws:ecr:${REGION}:${ACCOUNT_ID}:repository/${NAME_PREFIX}"
    },
    {
      "Sid": "EcsDeploy",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRoles",
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": [
        "arn:aws:iam::${ACCOUNT_ID}:role/${NAME_PREFIX}-ecs-execution",
        "arn:aws:iam::${ACCOUNT_ID}:role/${NAME_PREFIX}-ecs-task"
      ]
    }
  ]
}
EOF
)"

aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${NAME_PREFIX}-github-deploy" \
  --policy-document "${POLICY}"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

cat <<EOT

Set these GitHub repository VARIABLES (Settings → Secrets and variables → Actions → Variables):

  AWS_ROLE_ARN=${ROLE_ARN}
  AWS_REGION=${REGION}
  AWS_ECR_REPOSITORY=${NAME_PREFIX}
  AWS_ECS_CLUSTER=${NAME_PREFIX}
  AWS_ECS_SERVICE=${NAME_PREFIX}
  AWS_PUBLIC_BASE_URL=https://bisync.ai

Then run Terraform in infra/aws (creates ECR/ECS/RDS/ALB/DNS), push an image, and run workflow "Deploy AWS".

EOT
