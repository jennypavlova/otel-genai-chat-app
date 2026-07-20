#!/usr/bin/env bash
# Start the backend with EDOT Python (Elastic Distribution of OpenTelemetry).
# Uses the .venv-edot virtualenv created by `make setup-edot`.
#
# EDOT enriches traces with extra Elastic-specific attributes and produces
# richer service maps and transaction names in Kibana APM compared to vanilla.
# Compare the two by running vanilla vs EDOT side-by-side.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
VENV="$SCRIPT_DIR/.venv-edot"

if [[ ! -d "$VENV" ]]; then
  echo "❌  .venv-edot not found. Run: make setup-edot"
  exit 1
fi

# Load .env from repo root
if [[ -f "$REPO_ROOT/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$REPO_ROOT/.env" | grep -v '^$' | xargs)
fi

echo "▶  Starting backend (EDOT Python) — OTLP → $OTEL_EXPORTER_OTLP_ENDPOINT"
echo "   Service: ${OTEL_SERVICE_NAME:-otel-genai-chat-app}"
echo "   Model:   ${OPENAI_MODEL:-gpt-4o-mini}"

"$VENV/bin/opentelemetry-instrument" \
  --service_name "${OTEL_SERVICE_NAME:-otel-genai-chat-app}" \
  "$VENV/bin/uvicorn" app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --app-dir "$SCRIPT_DIR" \
    --reload
