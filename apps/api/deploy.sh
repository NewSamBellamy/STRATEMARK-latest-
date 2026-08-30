#!/usr/bin/env bash
#
# Deploy the Stratemark agent service to Cloud Run.
#
#   ./apps/api/deploy.sh
#
# Run it from the repository root. Idempotent: safe to re-run for every
# revision. It enables the APIs it needs, provisions the secret if it is
# missing, deploys, and prints the service URL.
#
# The Gemini key is never passed as an argument — arguments land in shell
# history and in the process table. It is read from a terminal prompt with echo
# disabled and piped straight into Secret Manager.
#
# Prerequisites: gcloud installed, `gcloud auth login` done, billing enabled.

set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-stratemark-agent}"
SECRET="${SECRET:-gemini-api-key}"
# Vertex AI uses the service account instead of a key. Set USE_VERTEX=false to
# deploy with a Gemini Developer API key in Secret Manager instead.
USE_VERTEX="${USE_VERTEX:-true}"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "No project set. Run:  gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

echo "▸ Project ${PROJECT} · region ${REGION} · service ${SERVICE}"

echo "▸ Enabling required APIs (no-op if already on)"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  --project "${PROJECT}" --quiet

# Ensure Firestore database exists in native mode
if ! gcloud firestore databases describe --project "${PROJECT}" >/dev/null 2>&1; then
  echo "▸ Provisioning Firestore Database (default) in ${REGION}"
  gcloud firestore databases create --location="${REGION}" --type=firestore-native --project "${PROJECT}" --quiet || true
fi

# DAILY_CAP_USD is the per-instance ceiling on spend from server credentials.
# Worst case across the service is DAILY_CAP_USD × MAX_INSTANCES, so both are
# set deliberately rather than left to defaults.
DAILY_CAP_USD="${DAILY_CAP_USD:-4}"
MAX_INSTANCES="${MAX_INSTANCES:-2}"
ENV_VARS="USE_VERTEX_AI=${USE_VERTEX},GOOGLE_CLOUD_PROJECT=${PROJECT},GOOGLE_CLOUD_LOCATION=${REGION},DAILY_CAP_USD=${DAILY_CAP_USD}"
SECRET_ARGS=()

if [[ "${USE_VERTEX}" != "true" ]]; then
  if ! gcloud secrets describe "${SECRET}" --project "${PROJECT}" >/dev/null 2>&1; then
    echo "▸ Secret ${SECRET} does not exist yet."
    read -rsp "  Paste the Gemini API key (input hidden): " KEY
    echo
    printf '%s' "${KEY}" | gcloud secrets create "${SECRET}" \
      --data-file=- --replication-policy=automatic --project "${PROJECT}" --quiet
    unset KEY
    echo "▸ Secret created."
  fi
  SECRET_ARGS=(--set-secrets "GEMINI_API_KEY=${SECRET}:latest")
fi

# A shared token authorising use of the service's OWN credentials. Without it
# the service refuses all server-credentialled work, which is the safe default:
# Cloud Run's --max-instances bounds concurrency, not spend, so a public
# endpoint attached to a billable key needs its own throttle.
if ! gcloud secrets describe app-token --project "${PROJECT}" >/dev/null 2>&1; then
  echo "▸ Generating an app access token"
  openssl rand -hex 24 | tr -d '\n' | gcloud secrets create app-token \
    --data-file=- --replication-policy=automatic --project "${PROJECT}" --quiet
fi
SECRET_ARGS+=(--update-secrets "APP_TOKEN=app-token:latest")

# A shared secret so only Cloud Scheduler can trigger paid refresh work.
if ! gcloud secrets describe scheduler-token --project "${PROJECT}" >/dev/null 2>&1; then
  echo "▸ Generating a scheduler token"
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create scheduler-token \
    --data-file=- --replication-policy=automatic --project "${PROJECT}" --quiet
fi
SECRET_ARGS+=(--update-secrets "SCHEDULER_TOKEN=scheduler-token:latest")

echo "▸ Building and deploying (Cloud Build does the container work)"
gcloud run deploy "${SERVICE}" \
  --source . \
  --project "${PROJECT}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --concurrency 4 \
  --max-instances "${MAX_INSTANCES}" \
  --set-env-vars "${ENV_VARS}" \
  "${SECRET_ARGS[@]}" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" --project "${PROJECT}" --region "${REGION}" --format='value(status.url)')"

APP_TOKEN_VALUE="$(gcloud secrets versions access latest --secret=app-token --project "${PROJECT}" 2>/dev/null || echo '<unset>')"

echo
echo "✓ Deployed: ${URL}"
echo
echo "  Verify:   curl ${URL}/healthz"
echo "  Graph:    curl ${URL}/v1/agent-graph"
echo
echo "  This URL is what the demo video must show on screen."
echo
echo "  Spend guard:  \$${DAILY_CAP_USD}/day per instance × ${MAX_INSTANCES} instances."
echo "                Browsing is free; only server-credentialled work is metered."
echo "                Callers who send their own key in X-Gemini-Key are never metered."
echo
echo "  App token (authorises use of OUR credentials — also goes in the judge"
echo "  testing instructions so they can try it without their own key):"
echo "    ${APP_TOKEN_VALUE}"
echo
echo "  Point the web app at it:"
echo "    VITE_API_BASE_URL=${URL}"
echo "    VITE_API_APP_TOKEN=${APP_TOKEN_VALUE}"
echo
echo "  STRONGLY RECOMMENDED — a billing backstop the app cannot bypass:"
echo "    gcloud billing budgets create --billing-account=YOUR_BILLING_ACCOUNT \\"
echo "      --display-name='Stratemark cap' --budget-amount=50USD \\"
echo "      --threshold-rule=percent=0.5 --threshold-rule=percent=0.9"
echo
echo "  Then create the scheduled refresh:"
echo "    gcloud scheduler jobs create http stratemark-refresh \\"
echo "      --project ${PROJECT} --location ${REGION} --schedule '0 7 * * *' \\"
echo "      --uri '${URL}/tasks/refresh' --http-method POST \\"
echo "      --headers \"x-scheduler-token=\$(gcloud secrets versions access latest --secret=scheduler-token --project ${PROJECT})\""
