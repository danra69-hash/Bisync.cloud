#!/usr/bin/env bash
# One-time bootstrap for a STANDALONE Pulse GCP project (not Bisync).
#
# Prerequisites (on your machine — Cloud Agents cannot do this):
#   1. Google Cloud Console → create project (suggested ID: pulse-fitness-cloud)
#   2. Link a billing account to that project
#   3. gcloud auth login && gcloud auth application-default login
#   4. gh auth login (to write GitHub Actions variables)
#
# Usage:
#   ./pulse/scripts/setup-gcp.sh --project=pulse-fitness-cloud
#   ./pulse/scripts/setup-gcp.sh --project=pulse-fitness-cloud --create-project --billing=XXXXXX-XXXXXX-XXXXXX
#
# What it creates (all Pulse-owned, no Bisync resources):
#   - APIs, Artifact Registry repo `pulse`, Cloud SQL `pulse-pg`, DB `pulse`
#   - Secret `pulse-db-password`
#   - GitHub Actions WIF + SA `pulse-github-deploy`
#   - GitHub repo VARIABLES: PULSE_GCP_PROJECT_ID, PULSE_GCP_WORKLOAD_IDENTITY_PROVIDER, PULSE_GCP_SERVICE_ACCOUNT

set -euo pipefail

PROJECT_ID=""
BILLING_ACCOUNT=""
CREATE_PROJECT=0
REGION="${PULSE_REGION:-asia-southeast1}"
REPO="${PULSE_GITHUB_REPO:-danra69-hash/Bisync.cloud}"
REPO_OWNER="${REPO%%/*}"
SA_NAME="pulse-github-deploy"
POOL_ID="pulse-github-pool"
PROVIDER_ID="pulse-github-provider"
AR_REPO="pulse"
SQL_INSTANCE="pulse-pg"
DB_NAME="pulse"
DB_USER="pulse"
SECRET_ID="pulse-db-password"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project=*) PROJECT_ID="${1#*=}" ;;
    --billing=*) BILLING_ACCOUNT="${1#*=}" ;;
    --create-project) CREATE_PROJECT=1 ;;
    --region=*) REGION="${1#*=}" ;;
    --repo=*) REPO="${1#*=}"; REPO_OWNER="${REPO%%/*}" ;;
    -h|--help)
      sed -n '1,25p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Required: --project=YOUR_PULSE_PROJECT_ID" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null; then
  echo "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

echo ""
echo "=== Pulse standalone GCP setup ==="
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Repo:     ${REPO}"
echo ""

if [[ "${CREATE_PROJECT}" -eq 1 ]]; then
  if gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Project ${PROJECT_ID} already exists."
  else
    echo "==> Creating project ${PROJECT_ID} ..."
    gcloud projects create "${PROJECT_ID}" --name="Pulse Fitness Cloud"
  fi
  if [[ -n "${BILLING_ACCOUNT}" ]]; then
    echo "==> Linking billing ${BILLING_ACCOUNT} ..."
    gcloud billing projects link "${PROJECT_ID}" --billing-account="${BILLING_ACCOUNT}"
  else
    echo "NOTE: Link billing in Console if not already linked (required for Cloud SQL / Run)."
  fi
fi

gcloud config set project "${PROJECT_ID}"

echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "==> Creating service account ${SA_EMAIL}"
  gcloud iam service-accounts create "${SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="Pulse GitHub Actions deploy"
fi

for role in \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.admin \
  roles/artifactregistry.writer \
  roles/storage.admin \
  roles/iam.serviceAccountUser \
  roles/cloudsql.admin \
  roles/secretmanager.admin \
  roles/logging.viewer \
  roles/browser
do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${role}" \
    --condition=None >/dev/null
done

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --condition=None >/dev/null

gcloud iam service-accounts add-iam-policy-binding "${COMPUTE_SA}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

echo "==> Artifact Registry ${AR_REPO}..."
if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="Pulse container images"
fi

echo "==> Secret ${SECRET_ID}..."
if ! gcloud secrets describe "${SECRET_ID}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  printf '%s' "${DB_PASS}" | gcloud secrets create "${SECRET_ID}" \
    --project="${PROJECT_ID}" \
    --replication-policy=automatic \
    --data-file=-
  echo "Generated DB password stored in Secret Manager (${SECRET_ID})."
else
  DB_PASS="$(gcloud secrets versions access latest --secret="${SECRET_ID}" --project="${PROJECT_ID}")"
fi

gcloud secrets add-iam-policy-binding "${SECRET_ID}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/cloudsql.client" \
  --condition=None >/dev/null

echo "==> Cloud SQL ${SQL_INSTANCE} (may take several minutes)..."
if ! gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud sql instances create "${SQL_INSTANCE}" \
    --project="${PROJECT_ID}" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region="${REGION}" \
    --storage-auto-increase \
    --root-password="${DB_PASS}"
fi

if ! gcloud sql databases describe "${DB_NAME}" --instance="${SQL_INSTANCE}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud sql databases create "${DB_NAME}" --instance="${SQL_INSTANCE}" --project="${PROJECT_ID}"
fi

# App DB user (separate from postgres root when possible)
if ! gcloud sql users list --instance="${SQL_INSTANCE}" --project="${PROJECT_ID}" --format='value(name)' | grep -qx "${DB_USER}"; then
  gcloud sql users create "${DB_USER}" \
    --instance="${SQL_INSTANCE}" \
    --project="${PROJECT_ID}" \
    --password="${DB_PASS}" || true
fi

echo "==> Workload Identity Federation for GitHub Actions..."
if ! gcloud iam workload-identity-pools describe "${POOL_ID}" \
  --project="${PROJECT_ID}" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --project="${PROJECT_ID}" \
    --location=global \
    --display-name="Pulse GitHub pool"
fi

if ! gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" \
    --location=global \
    --workload-identity-pool="${POOL_ID}" \
    --display-name="Pulse GitHub provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository_owner == '${REPO_OWNER}'"
fi

POOL_RESOURCE="//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
PROVIDER_RESOURCE="${POOL_RESOURCE}/providers/${PROVIDER_ID}"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}" \
  >/dev/null

if command -v gh >/dev/null; then
  echo "==> Setting GitHub Actions VARIABLES (Pulse-only)..."
  gh variable set PULSE_GCP_PROJECT_ID --body "${PROJECT_ID}" --repo "${REPO}"
  gh variable set PULSE_GCP_WORKLOAD_IDENTITY_PROVIDER --body "${PROVIDER_RESOURCE}" --repo "${REPO}"
  gh variable set PULSE_GCP_SERVICE_ACCOUNT --body "${SA_EMAIL}" --repo "${REPO}"
  gh variable set PULSE_GCP_REGION --body "${REGION}" --repo "${REPO}"
else
  echo "gh CLI not found — set these GitHub repo VARIABLES manually:"
  echo "  PULSE_GCP_PROJECT_ID=${PROJECT_ID}"
  echo "  PULSE_GCP_WORKLOAD_IDENTITY_PROVIDER=${PROVIDER_RESOURCE}"
  echo "  PULSE_GCP_SERVICE_ACCOUNT=${SA_EMAIL}"
  echo "  PULSE_GCP_REGION=${REGION}"
fi

SQL_CONN="$(gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" --format='value(connectionName)')"

echo ""
echo "=== Pulse GCP ready (independent of Bisync) ==="
echo "Project:     ${PROJECT_ID}"
echo "SQL:         ${SQL_CONN}"
echo "Database:    ${DB_NAME}"
echo "Registry:    ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
echo "Deploy SA:   ${SA_EMAIL}"
echo "WIF:         ${PROVIDER_RESOURCE}"
echo ""
echo "Next:"
echo "  1. Push Pulse code to the 'pulse' release branch (not Bisync master)."
echo "  2. GitHub → Actions → Deploy Pulse → Run workflow"
echo "  3. Or: git push origin HEAD:pulse"
echo ""
