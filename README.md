# 🔭 otel-genai-chat-app

A minimal chat application for exploring **OpenTelemetry GenAI semantic conventions** with the OpenAI SDK.

| Layer | Technology |
|---|---|
| Backend | Python 3.10+ · FastAPI · streaming SSE |
| Frontend | React 19 · TypeScript · Vite |
| Instrumentation | `opentelemetry-instrumentation-openai-v2` (vanilla) **or** EDOT Python |
| Telemetry sink | Local OTel Collector → Elasticsearch / Kibana APM **or** Elastic Cloud direct |

Every chat request automatically produces:
- `gen_ai.*` spans (model, token usage, request/response attributes per the [GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/))
- HTTP server spans for the FastAPI endpoint
- Optional prompt/response content as span events (toggle with `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`)

---

## Quick-start

### 1. Clone & configure

```bash
git clone https://github.com/jennypavlova/otel-genai-chat-app.git
cd otel-genai-chat-app
cp .env.example .env
```

Edit `.env` and fill in:
- `OPENAI_API_KEY` — your OpenAI-compatible API key
- `OPENAI_BASE_URL` — blank for OpenAI; or e.g. `http://localhost:4000/v1` for LiteLLM
- `OPENAI_MODEL` — any model your provider supports (default: `gpt-4o-mini`)

> ⚠️ **Never commit `.env` to git.** It is gitignored. Store secrets only there.

### 2. Start the OTel Collector (local stack path)

```bash
# Requires Docker. Starts the otelcol-contrib collector on :4318 (HTTP) / :4317 (gRPC).
# Your local Elasticsearch must already be running — the collector forwards to it.
make collector-up
```

See [Collector → Elasticsearch setup](#collector--elasticsearch-setup) for the required `.env` variables.

### 3. Set up the backend

Choose **vanilla** or **EDOT** — or set up both to compare side-by-side:

```bash
make setup-vanilla   # creates backend/.venv-vanilla
make setup-edot      # creates backend/.venv-edot
```

### 4. Run the backend

```bash
make run-vanilla     # vanilla upstream OTel instrumentation
# or
make run-edot        # EDOT Python (Elastic-enriched)
```

The backend starts on **http://localhost:8000**.

### 5. Run the frontend

```bash
make setup-frontend  # npm install
make run-frontend    # Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** and start chatting.

---

## Architecture

```
Browser (React + TS)
  │  POST /api/chat  (SSE stream)
  ▼
FastAPI backend  ──── openai.chat.completions.create(stream=True) ──►  LLM API
  │
  │  OTLP/HTTP  (auto-instrumented, no manual span code)
  ▼
OTel Collector  ──► Elasticsearch  ──► Kibana APM
   (or direct)   └──► Elastic Cloud managed OTLP
```

The instrumentation wraps the FastAPI process at startup via `opentelemetry-instrument` — no changes to application code are needed.

---

## Configuration reference

All settings live in `.env` (gitignored). See `.env.example` for the full list.

| Variable | Description | Example |
|---|---|---|
| `OPENAI_API_KEY` | API key for your LLM provider | `sk-…` |
| `OPENAI_BASE_URL` | Base URL (blank = OpenAI default) | `http://localhost:4000/v1` |
| `OPENAI_MODEL` | Default model name | `gpt-4o-mini` |
| `OTEL_SERVICE_NAME` | Service name in APM | `otel-genai-chat-app` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Where to send telemetry | `http://localhost:4318` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers (Elastic Cloud) | `Authorization=ApiKey …` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Exporter protocol | `http/protobuf` |
| `OTEL_RESOURCE_ATTRIBUTES` | Extra resource attributes; **required for EDOT APM service discovery** — set `telemetry.distro.name=elastic` so Kibana recognises the service as EDOT-managed | `telemetry.distro.name=elastic` |
| `OTEL_DEPLOYMENT_ENVIRONMENT` | Deployment environment shown in APM UI | `development` |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | Capture prompt/response content as span events (`true` or `false`) | `false` |
| `ELASTIC_ES_ENDPOINT` | ES endpoint for the local collector | `http://host.docker.internal:9200` |
| `ELASTIC_ES_API_KEY` | ES API key for the local collector | `base64string…` |

---

## Vanilla OTel vs EDOT — what's different?

| | Vanilla (`make run-vanilla`) | EDOT (`make run-edot`) |
|---|---|---|
| Package | `opentelemetry-distro` + `opentelemetry-instrumentation-openai-v2` | `elastic-opentelemetry` |
| GenAI semconv spans | ✅ `gen_ai.*` attributes | ✅ `gen_ai.*` attributes + Elastic enrichment |
| Kibana APM transaction names | Basic URL pattern | Richer names from EDOT conventions |
| Service maps | Partial | Full (Elastic agent metadata) |
| Setup | Manual package list | Single `elastic-opentelemetry` install |

Run both and compare in **Kibana APM → Services → otel-genai-chat-app**.

---

## Telemetry export paths

### Path A — Local collector (default for local development)

1. Start your local Elasticsearch + Kibana (not included here — use your existing stack or a docker-compose from another repo).
2. Create an Elasticsearch API key with write access to `logs-*`, `metrics-*`, `traces-*`.
3. Set in `.env`:
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   ELASTIC_ES_ENDPOINT=http://host.docker.internal:9200
   ELASTIC_ES_API_KEY=<your-es-api-key>
   ```
4. Run `make collector-up`.

The collector uses the **`elasticsearch` exporter in OTel mapping mode** (`mapping.mode: otel`) so all data is indexed into OTel-compatible index templates that Kibana APM understands.

### Path B — Elastic Cloud (managed OTLP endpoint, no collector)

1. In your Elastic Cloud project: **Add data → Applications → OpenTelemetry**. Copy the endpoint URL and generate an API key.
2. Set in `.env`:
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=https://<cluster>.apm.<region>.aws.found.io
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=ApiKey <your-elastic-api-key>
   ```
3. Skip `make collector-up` — the backend sends directly to the cloud.

---

## Collector → Elasticsearch setup

The `otel-collector-config.yaml` uses the `elasticsearch` exporter from [otelcol-contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib). Key settings:

```yaml
exporters:
  elasticsearch:
    endpoints: ["${env:ELASTIC_ES_ENDPOINT}"]
    api_key: "${env:ELASTIC_ES_API_KEY}"
    mapping:
      mode: otel    # ← required for Kibana APM to display traces correctly
```

The collector image (`otelcol-contrib:latest`) is pulled from GitHub Container Registry — no authentication needed.

---

## Viewing traces in Kibana

> **EDOT APM visibility prerequisite:** For the service to appear under **Kibana → Observability → APM**, you must set `OTEL_RESOURCE_ATTRIBUTES=telemetry.distro.name=elastic` in your `.env`. This attribute tells Kibana that the data comes from an EDOT-managed SDK. Without it, spans still arrive in Elasticsearch but the service will not surface in the APM Services list. Also set `OTEL_DEPLOYMENT_ENVIRONMENT=development` (or your preferred value) so the environment filter in APM works correctly.

1. **Kibana → Observability → APM → Services** — find `otel-genai-chat-app`.
2. Click the service → **Transactions** → select a `POST /api/chat` transaction.
3. Open the waterfall view. You will see:
   - The FastAPI HTTP span at the top
   - A child `gen_ai.chat` span for the OpenAI call with attributes like:
     - `gen_ai.system` = `openai`
     - `gen_ai.request.model`
     - `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`
     - Prompt/response content as span events (only when `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true`; defaults to `false`)
4. Switch between vanilla and EDOT runs to compare attribute richness.

---

## LiteLLM compatibility

This app is designed to work with [LiteLLM](https://github.com/BerriAI/litellm) as a drop-in OpenAI-compatible proxy:

```bash
# Start LiteLLM with your preferred provider
litellm --model ollama/llama3.2 --port 4000

# In .env:
OPENAI_BASE_URL=http://localhost:4000/v1
OPENAI_API_KEY=any-string   # LiteLLM accepts any key in this mode
OPENAI_MODEL=ollama/llama3.2
```

---

## Development notes

- **Scripts are bash** — `run-vanilla.sh` and `run-edot.sh` must be executable (`chmod +x`). The `Makefile` calls them via `bash` so the `+x` bit isn't strictly required.
- **Two virtualenvs** (`backend/.venv-vanilla`, `backend/.venv-edot`) keep the two OTel distros cleanly separated — avoid mixing packages between them.
- **No OTel code in the app** — all instrumentation is injected by `opentelemetry-instrument` at process start. This is intentional: the point is to test zero-code auto-instrumentation.
- The Vite dev server proxies `/api` → `http://localhost:8000`, so the browser never needs to know the backend port and no CORS setup is required for development.

---

## Useful links

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [`opentelemetry-instrumentation-openai-v2`](https://pypi.org/project/opentelemetry-instrumentation-openai-v2/)
- [EDOT Python (elastic-opentelemetry)](https://www.elastic.co/docs/reference/opentelemetry/edot-sdks/python/setup)
- [Elastic Cloud managed OTLP quickstart](https://www.elastic.co/docs/solutions/observability/get-started/quickstart-elastic-cloud-otel-endpoint)
- [otelcol-contrib elasticsearch exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/elasticsearchexporter)
