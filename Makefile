PYTHON ?= $(shell test -x .venv/bin/python && echo .venv/bin/python || echo python3)
APP ?= services.api.main:build_app
PORT ?= 8080

ifneq (,$(wildcard .env))
include .env
export
endif

.PHONY: help setup local-up seed smoke test contract lint dashboard-install dashboard dashboard-test dashboard-build dashboard-check

help:
	@echo "setup             create .venv and install the package with dev extras"
	@echo "local-up          run the API on 127.0.0.1:$(PORT) (requires LAD_COLLECTOR_TOKEN/LAD_ADMIN_TOKEN)"
	@echo "seed              insert 3 contract-valid demo incidents into LAD_DATA_DIR"
	@echo "smoke             start the API on a temp DB and exercise the HTTP contract"
	@echo "test              lint, then run the test suite"
	@echo "contract          lint, validate fixtures + openapi.yaml, run contract tests"
	@echo "lint              run ruff"
	@echo "dashboard-install install npm dependencies, then start the dev server"
	@echo "dashboard         start the dashboard dev server on 127.0.0.1:5173"
	@echo "dashboard-test    run dashboard component tests"
	@echo "dashboard-build   typecheck and build the dashboard bundle"
	@echo "dashboard-check   build, then assert the bundle carries no credentials"

setup:
	uv venv .venv --python 3.10
	uv pip install --python .venv/bin/python -e ".[dev]"

local-up:
	$(PYTHON) -m uvicorn $(APP) --factory --host 127.0.0.1 --port $(PORT)

seed:
	$(PYTHON) -m scripts.seed_incidents

smoke:
	$(PYTHON) -m scripts.smoke

lint:
	$(PYTHON) -m ruff check src services tests scripts

test: lint
	$(PYTHON) -m pytest -q

contract: lint
	$(PYTHON) scripts/validate_fixtures.py contracts/fixtures contracts/schemas
	$(PYTHON) -m openapi_spec_validator contracts/openapi.yaml
	$(PYTHON) -m pytest tests/contract -q

dashboard-install:
	cd dashboard && npm install

dashboard:
	@echo "dashboard: http://localhost:5173 (proxying /api to $(LAD_API_BASE_URL))"
	cd dashboard && npm run dev

dashboard-test:
	cd dashboard && npm test

dashboard-build:
	cd dashboard && npm run build

dashboard-check: dashboard-build
	cd dashboard && npm run check:bundle
