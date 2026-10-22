PYTHON ?= $(shell test -x .venv/bin/python && echo .venv/bin/python || echo python3)
APP ?= services.api.main:build_app
PORT ?= 8080

ifneq (,$(wildcard .env))
include .env
export
endif

.PHONY: help setup local-up test contract lint

help:
	@echo "setup     create .venv and install the package with dev extras"
	@echo "local-up  run the API on 127.0.0.1:$(PORT) (requires LAD_COLLECTOR_TOKEN/LAD_ADMIN_TOKEN)"
	@echo "test      lint, then run the test suite"
	@echo "contract  lint, validate fixtures + openapi.yaml, run contract tests"
	@echo "lint      run ruff"

setup:
	uv venv .venv --python 3.10
	uv pip install --python .venv/bin/python -e ".[dev]"

local-up:
	$(PYTHON) -m uvicorn $(APP) --factory --host 127.0.0.1 --port $(PORT)

lint:
	$(PYTHON) -m ruff check src services tests scripts

test: lint
	$(PYTHON) -m pytest -q

contract: lint
	$(PYTHON) scripts/validate_fixtures.py contracts/fixtures contracts/schemas
	$(PYTHON) -m openapi_spec_validator contracts/openapi.yaml
	$(PYTHON) -m pytest tests/contract -q
