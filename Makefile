.PHONY: help setup-vanilla setup-edot run-vanilla run-edot \
        setup-frontend run-frontend collector-up collector-down clean

PYTHON    ?= python3
BACKEND   := backend
FRONTEND  := frontend

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Backend setup ─────────────────────────────────────────────────────────────

setup-vanilla: ## Create .venv-vanilla and install vanilla OTel dependencies
	$(PYTHON) -m venv $(BACKEND)/.venv-vanilla
	$(BACKEND)/.venv-vanilla/bin/pip install --upgrade pip
	$(BACKEND)/.venv-vanilla/bin/pip install -r $(BACKEND)/requirements-vanilla.txt
	@echo "✅  .venv-vanilla ready"

setup-edot: ## Create .venv-edot and install EDOT Python dependencies
	$(PYTHON) -m venv $(BACKEND)/.venv-edot
	$(BACKEND)/.venv-edot/bin/pip install --upgrade pip
	$(BACKEND)/.venv-edot/bin/pip install -r $(BACKEND)/requirements-edot.txt
	$(BACKEND)/.venv-edot/bin/opentelemetry-bootstrap -a install
	@echo "✅  .venv-edot ready"

# ── Backend run ───────────────────────────────────────────────────────────────

run-vanilla: ## Run backend with vanilla upstream OTel instrumentation
	bash $(BACKEND)/run-vanilla.sh

run-edot: ## Run backend with EDOT Python (Elastic-enriched) instrumentation
	bash $(BACKEND)/run-edot.sh

# ── Frontend ──────────────────────────────────────────────────────────────────

setup-frontend: ## Install frontend npm dependencies
	cd $(FRONTEND) && npm install

run-frontend: ## Start Vite dev server (frontend)
	cd $(FRONTEND) && npm run dev

# ── Collector ─────────────────────────────────────────────────────────────────

collector-up: ## Start the EDOT Collector (docker-compose, detached)
	docker compose up -d
	@echo "✅  EDOT Collector listening on :4318 (HTTP) and :4317 (gRPC)"
	@echo "   Traces → traces-generic.otel-*  (gen_ai.* as dotted names)"
	@echo "   Metrics → metrics-*.otel-*      (service_transaction for APM UI)"

collector-down: ## Stop and remove the EDOT Collector container
	docker compose down --remove-orphans

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean: ## Remove virtualenvs and frontend node_modules
	rm -rf $(BACKEND)/.venv-vanilla $(BACKEND)/.venv-edot
	rm -rf $(FRONTEND)/node_modules $(FRONTEND)/dist
	@echo "🧹  Cleaned"
