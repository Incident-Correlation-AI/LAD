# Log Anomaly Detector (LAD) — Architecture & Codebase Guide

This document explains what the **Log Anomaly Detector (LAD)** API service does, how every file in the repository functions, and how they interact together.

---

## 1. High-Level Overview & System Role

### Purpose
**LAD** is the backend API service for an incident correlation and log anomaly detection system. It serves two core responsibilities:
1. **Event Ingestion (Collector Lane):** Receives high-volume normalized log events from external log collectors (e.g., Fluent Bit, Vector, syslog/journald, Windows Event Log), strictly validates them, deduplicates them, and enqueues them for asynchronous detection workers.
2. **Incident Serving & Lifecycle Management (Admin Lane):** Persists correlated anomaly incidents, supports filtered queries with cursor pagination, and provides idempotent lifecycle state transitions (`acknowledged`, `resolved`) with immutable audit trails.

### Architecture Paradigm: Hexagonal (Ports & Adapters)
The project is strictly separated into:
- **Core Domain & Contracts (`src/lad/contracts/`):** Pure data schemas, JSON schema validation, and typed models. Free of HTTP and infrastructure dependencies.
- **Ports (`src/lad/ports/`):** Python abstract protocols defining interfaces for storage, queues, and clocks.
- **Adapters (`src/lad/adapters/local/`):** Concrete local implementations (SQLite database with WAL mode, atomic file-based queue on disk, in-memory queue for tests).
- **Service Layer (`services/api/`):** FastAPI HTTP layer handling routing, authentication, request-id tracking, payload limits, and error mapping.
- **Contract-First Authority (`contracts/`):** Canonical JSON schemas and OpenAPI 3.1 specification. The code conforms to the contract, not the other way around.

---

## 2. Core Architectural Guarantees

- **Contract Authority:** The JSON Schemas in `contracts/schemas/` and `contracts/openapi.yaml` are the single source of truth. Tests enforce exact parity.
- **Asynchronous Detection (HTTP 202 Accepted):** Ingestion returns `202 Accepted` to indicate that events are queued, **not** that detection has run or an incident was produced.
- **Partial Acceptance:** Each event in a batch is validated independently. A batch with 3 valid events and 1 invalid event will accept the 3 valid ones into the queue and return a detailed rejection reason for the 1 invalid event.
- **Idempotency & Deduplication:** `event_id` acts as the unique deduplication key within a configurable TTL (default 7 days). If an event is re-sent, it is marked `accepted` with `"already accepted"` detail without being enqueued twice.
- **Role Isolation:** Two distinct Bearer token identities:
  - `collectorAuth`: Can **only** submit event batches (`POST /api/v1/events/batch`).
  - `adminAuth`: Can **only** read incidents and perform lifecycle actions (`GET/POST /api/v1/incidents*`).
- **Standardized Error Envelope:** Every failure response strictly follows `contracts/schemas/api-errors.schema.json` with an 8-code closed enum, human-readable message, request correlation ID, and optional locator details.

---

## 3. Directory Layout & File-by-File Explanation

```
LAD/
├── Makefile                                # Developer workflows & automation
├── pyproject.toml                          # Build config, dependencies, ruff/pytest settings
├── .env.example                            # Configuration environment variable template
├── README.md                               # Project quickstart and runbook
├── contracts/                              # Canonical contract definitions
│   ├── openapi.yaml                        # Canonical OpenAPI 3.1 spec (exactly 6 routes)
│   ├── schemas/                            # Canonical JSON Schemas
│   │   ├── event.schema.json               # Normalized event envelope schema
│   │   ├── incident.schema.json            # Anomaly incident schema
│   │   └── api-errors.schema.json          # Uniform API error schema
│   └── fixtures/                           # Contract test fixtures
│       ├── valid/                          # Valid JSON event payloads
│       └── invalid/                        # Invalid payloads + *.meta.json expectations
├── docs/decisions/
│   └── 0001-api-error-contract.md          # Architectural Decision Record for error handling
├── src/lad/                                # Core domain package
│   ├── contracts/
│   │   ├── validation.py                   # jsonschema loading & validation helpers
│   │   ├── event.py                        # Pydantic model for Event
│   │   └── incident.py                     # Pydantic models for Incident & sub-components
│   ├── ports/
│   │   ├── clock.py                        # ClockPort protocol & SystemClock
│   │   ├── queue.py                        # QueuePort protocol & Handle dataclass
│   │   └── store.py                        # StorePort protocol (dedup, incidents, lifecycle)
│   └── adapters/local/
│       ├── queue_fs.py                     # FileQueue: directory-backed atomic file queue
│       ├── queue_memory.py                 # InMemoryQueue: ephemeral in-memory queue for tests
│       └── store_sqlite.py                 # SQLiteStore: SQLite WAL implementation of StorePort
├── services/api/                           # HTTP Service (FastAPI)
│   ├── config.py                           # Settings dataclass from LAD_* environment variables
│   ├── auth.py                             # Bearer token verification with constant-time compare
│   ├── errors.py                           # Custom ApiError & global exception handlers
│   ├── main.py                             # FastAPI application factory (build_app)
│   └── routers/
│       ├── health.py                       # GET /api/v1/health (public liveness)
│       ├── ingestion.py                    # POST /api/v1/events/batch (collector ingestion)
│       └── incidents.py                    # Incidents queries & lifecycle actions
├── scripts/                                # Maintenance & operational tools
│   ├── seed_incidents.py                   # Seeds 3 demo incidents into SQLite
│   ├── smoke.py                            # End-to-end integration smoke test
│   └── validate_fixtures.py                # Validates fixtures against canonical JSON schemas
└── tests/                                  # Test suite
    ├── conftest.py                         # Pytest fixtures and mock dependencies
    ├── test_adapters.py                    # Tests for FileQueue and InMemoryQueue
    ├── test_auth.py                        # Tests for role isolation & auth errors
    ├── test_health.py                      # Tests for liveness endpoint & route exposure
    ├── test_ingestion.py                   # Tests for batch ingestion, validation, dedup
    ├── test_incidents.py                   # Tests for incident queries, pagination, lifecycle
    ├── test_store.py                       # Tests for SQLiteStore deduplication & incidents
    ├── test_seed.py                        # Tests for seed_incidents idempotency & validity
    └── contract/                           # Contract parity tests
        ├── test_fixtures.py                # Tests fixtures against schemas
        ├── test_models.py                  # Tests Pydantic models against schemas
        └── test_openapi.py                 # Validates openapi.yaml & enforces 100% route parity
```

---

## 4. Deep-Dive into Every File

### 4.1. Root Files
- **`Makefile`**:
  - `make setup`: Uses `uv` to initialize `.venv` (Python 3.10) and install package in editable mode with dev dependencies.
  - `make local-up`: Launches the Uvicorn server on `127.0.0.1:8080`.
  - `make seed`: Populates `data/lad.sqlite3` with 3 contract-valid demo incidents.
  - `make smoke`: Runs `scripts/smoke.py` against a temporary server.
  - `make test`: Runs `ruff` linter and the full `pytest` suite.
  - `make contract`: Validates fixtures against JSON schemas, verifies `openapi.yaml`, and executes contract parity tests.
- **`pyproject.toml`**: Defines project dependencies (`fastapi`, `uvicorn`, `pydantic`, `jsonschema`), dev dependencies (`pytest`, `httpx`, `ruff`, `openapi-spec-validator`), and tool configurations.
- **`.env.example`**: Documents all environment variables:
  - `LAD_MODE` (`local` or `aws`)
  - `LAD_COLLECTOR_TOKEN` & `LAD_ADMIN_TOKEN` (required credentials, must differ)
  - `LAD_DATA_DIR` (default: `data`)
  - `LAD_MAX_BATCH_EVENTS` (default: `100`), `LAD_MAX_BATCH_BYTES` (default: `262144` = 256 KiB)
  - `LAD_DEDUP_TTL_SECONDS` (default: 7 days)

### 4.2. Contracts & Specifications (`contracts/`)
- **`contracts/openapi.yaml`**: The canonical OpenAPI 3.1.0 document. Specifies the 6 exact endpoints, request/response models, and error responses. Automatic documentation (`/docs`, `/redoc`) is disabled in FastAPI so this file remains the single source of truth.
- **`contracts/schemas/event.schema.json`**: Canonical JSON Schema for normalized log events. Requires `schema_version` (fixed "1.0"), `event_id`, timezone-aware UTC timestamps (`event_ts`, `observed_ts`), `host`, `source`, `category`, `type`, `severity` (`info|warning|error|critical`), and `message`.
- **`contracts/schemas/incident.schema.json`**: Canonical JSON Schema for correlated incidents. Requires `incident_id`, `status` (`open|acknowledged|resolved`), `severity` (`low|medium|high|critical`), `anomaly_score`, `detector`, `affected_entities`, `evidence` (both supporting and contradicting event IDs), `hypotheses`, `diagnostic_checks`, and `audit` log array.
- **`contracts/schemas/api-errors.schema.json`**: Standard error envelope `{"error": {"code", "message", "request_id", "details"}}`. The `code` is a closed enum: `validation_failed`, `unauthorized`, `forbidden`, `not_found`, `payload_too_large`, `throttled`, `internal_error`, `dependency_unavailable`.
- **`contracts/fixtures/`**:
  - `valid/`: Sample payloads (`http_5xx.json`, `journald_minimal.json`, `windows_event.json`, `unknown_optional_field.json`) that must pass validation.
  - `invalid/`: Malformed payloads with `.meta.json` companions declaring the expected failure reason (e.g., naive timestamps, missing fields, bad severities).

### 4.3. Domain & Contracts (`src/lad/contracts/`)
- **`src/lad/contracts/validation.py`**:
  - `contracts_dir()`: Resolves the canonical `contracts/` directory path.
  - `load_schema(name)`: Caches and returns schema JSON.
  - `schema_validator(name)`: Builds a `Draft202012Validator` configured with `FormatChecker()` (validates `date-time`).
  - `validate_event(payload)` / `validate_incident(payload)`: Evaluates dictionaries directly against JSON schemas.
  - `rejection_reason(error)`: Maps JSON Schema validation error types to short machine-readable strings (e.g., `invalid_timestamp`, `missing_required_field`, `invalid_enum`, `unsupported_schema_version`).
- **`src/lad/contracts/event.py`**: Pydantic `Event` model. Extra fields are allowed (`extra="allow"`) to accommodate extensible attributes. Includes a validator ensuring timestamps are timezone-aware.
- **`src/lad/contracts/incident.py`**: Pydantic models (`Incident`, `AffectedEntity`, `Window`, `Evidence`, `Hypothesis`, `DiagnosticCheck`, `AuditEntry`). Enforces strict sub-structures (e.g. `DiagnosticCheck.executes` must be `False` because recommendations are advisory only).

### 4.4. Ports / Interfaces (`src/lad/ports/`)
- **`src/lad/ports/clock.py`**: Defines `ClockPort` protocol (`now() -> datetime`) and `SystemClock` implementation. Allows unit tests to freeze or manipulate time.
- **`src/lad/ports/queue.py`**: Defines `QueuePort` protocol:
  - `send(messages)`: Enqueue raw byte messages.
  - `receive(max_messages, visibility_timeout_s)`: Retrieve message handles.
  - `ack(handle)`: Acknowledge successful processing.
  - `nack(handle, retryable)`: Handle failures (requeue or dead-letter).
- **`src/lad/ports/store.py`**: Defines `StorePort` protocol:
  - `claim_event_id(event_id, ttl_seconds)`: Atomic deduplication claim.
  - `release_event_id(event_id)`: Un-claims an event if enqueueing fails.
  - `put_incident(incident)`: Persists an incident dictionary.
  - `get_incident(incident_id)`: Retrieves a single incident by ID.
  - `list_incidents(...)`: Queries incidents with filtering and pagination.
  - `update_status(...)`: Applies idempotent lifecycle updates and appends audit logs.

### 4.5. Local Adapters (`src/lad/adapters/local/`)
- **`src/lad/adapters/local/queue_fs.py` (`FileQueue`)**:
  - Implements `QueuePort` on the local filesystem.
  - Ingestion writes to `.tmp` files and executes an atomic `os.replace` to `data/queue/<timestamp>-<uuid>.json` so readers never see partial writes.
  - `ack()` deletes the file.
  - Non-retryable `nack()` moves the file to `data/queue/dead/` (Dead Letter Queue).
- **`src/lad/adapters/local/queue_memory.py` (`InMemoryQueue`)**:
  - Pure in-memory queue with thread locks. Used by unit tests for fast execution without filesystem side effects.
- **`src/lad/adapters/local/store_sqlite.py` (`SQLiteStore`)**:
  - Implements `StorePort` with SQLite in WAL (Write-Ahead Logging) mode.
  - Table `processed_events`: Tracks seen `event_id`, `seen_at`, and `expires_at`. `claim_event_id` lazily purges expired events, then runs `INSERT OR IGNORE`. If rowcount is 1, it's newly claimed; otherwise, it's a duplicate.
  - Table `incidents`: Stores `incident_id`, `status`, `severity`, `created_at`, `updated_at`, and the full JSON document `doc`.
  - `put_incident`: Runs `validate_incident` before upserting into SQLite.
  - `list_incidents`: Supports filtering on status, severity, time ranges, and uses SQLite's `json_each` to filter by affected host. Uses keyset cursor pagination (`created_at < ? OR (created_at = ? AND incident_id < ?)`). Cursors are URL-safe base64 strings (`created_at|incident_id`).
  - `update_status`: Validates action (`acknowledged` or `resolved`), checks idempotency (acknowledging an already acknowledged/resolved incident is a no-op), appends an audit entry, updates timestamps, and persists changes.

### 4.6. API Services Layer (`services/api/`)
- **`services/api/config.py` (`Settings`)**: Sourced from environment variables. Ensures `collector_token` and `admin_token` are non-empty and not equal. Configures batch limits and TTLs.
- **`services/api/auth.py`**:
  - Parses Bearer tokens from `Authorization` header.
  - Uses `hmac.compare_digest` with UTF-8 byte encoding to prevent timing attacks and avoid Python non-ASCII string TypeError crashes.
  - Resolves `Identity(role="collector")` or `Identity(role="admin")`.
  - Provides FastAPI dependencies `require_collector` and `require_admin`.
- **`services/api/errors.py`**:
  - `ApiError`: Application exception containing HTTP status code, message, and error details.
  - `install_error_handlers(app)`: Registers global handlers for `ApiError`, `RequestValidationError` (Pydantic/FastAPI), `StarletteHTTPException`, and generic `Exception`. Guarantees all responses match `api-errors.schema.json`.
- **`services/api/main.py` (`build_app`)**:
  - Application factory. Injects `Settings`, `StorePort` (default `SQLiteStore`), and `QueuePort` (default `FileQueue`).
  - Disables default Swagger/OpenAPI docs (`docs_url=None`).
  - Adds middleware to generate or propagate `X-Request-ID`.
  - Registers routers for health, ingestion, and incidents.
- **`services/api/routers/health.py`**:
  - `GET /api/v1/health`: Unauthenticated liveness check returning status, version, and UTC timestamp.
- **`services/api/routers/ingestion.py`**:
  - `POST /api/v1/events/batch`: Authenticated collector endpoint.
  - Checks byte payload size (header + body length <= 256 KiB).
  - Validates batch constraints (1 to 100 events).
  - Performs per-event JSON schema validation (partial acceptance).
  - Performs deduplication via `store.claim_event_id`.
  - Sends newly accepted events to `queue.send(...)`.
  - If queueing fails, rolls back claims via `store.release_event_id` and returns 503.
  - Returns `202 Accepted` with receipt and per-event results.
- **`services/api/routers/incidents.py`**:
  - `GET /api/v1/incidents`: Admin-only query endpoint with filtering and cursor pagination.
  - `GET /api/v1/incidents/{incident_id}`: Admin-only single incident lookup.
  - `POST /api/v1/incidents/{incident_id}/acknowledge`: Admin-only acknowledgment.
  - `POST /api/v1/incidents/{incident_id}/resolve`: Admin-only resolution.

### 4.7. Scripts & Tooling (`scripts/`)
- **`scripts/validate_fixtures.py`**: Standalone validator ensuring all fixtures in `contracts/fixtures/valid/` pass JSON schema validation and all in `contracts/fixtures/invalid/` fail with the expected reason specified in `.meta.json`.
- **`scripts/seed_incidents.py`**: Generates 3 realistic demo incidents (`inc_demo_checkout_5xx`, `inc_demo_db_latency`, `inc_demo_api_error_rate`) and upserts them into `data/lad.sqlite3`.
- **`scripts/smoke.py`**: End-to-end integration test. Starts a real Uvicorn server in a subprocess using a temporary directory, seeds data, and performs live HTTP requests against all 6 endpoints to verify contracts, auth, and deduplication.

### 4.8. Tests (`tests/`)
- **`tests/conftest.py`**: Pytest fixtures providing test settings, temporary SQLite database, in-memory queue, test client, and helper assertions (`assert_api_error`).
- **`tests/test_adapters.py`**: Validates file queue atomic writes, pending counts, and dead-letter moves, along with in-memory queue mechanics.
- **`tests/test_auth.py`**: Validates 401 on missing/bad tokens, 403 on role mismatches, and safe handling of non-ASCII credentials.
- **`tests/test_health.py`**: Verifies liveness output, header echoing, and hidden documentation endpoints.
- **`tests/test_ingestion.py`**: Comprehensive testing of batch limits, schema rejections, partial acceptance, idempotency, and storage failure rollbacks.
- **`tests/test_incidents.py`**: Verifies incident lookups, multi-field SQL filtering, cursor pagination, and lifecycle mutations.
- **`tests/test_seed.py`**: Ensures seed incidents pass schema checks and can be run repeatedly without duplicating records.
- **`tests/test_store.py`**: Tests SQLite store dedup TTL expiration, manual event release, and incident schema enforcement.
- **`tests/contract/`**:
  - `test_fixtures.py`: Asserts fixture validity against schemas.
  - `test_models.py`: Asserts Pydantic model round-trip parity with JSON schemas.
  - `test_openapi.py`: Validates OpenAPI 3.1 syntax and guarantees the application exposes exactly the 6 documented endpoints.

---

## 5. End-to-End Data Flow

```
                      [ Log Collectors ]
                              │  POST /api/v1/events/batch (Bearer: Collector)
                              ▼
                ┌───────────────────────────────┐
                │     services/api/auth.py      │ ◄── Validates collector role
                └──────────────┬────────────────┘
                               │
                               ▼
                ┌───────────────────────────────┐
                │ services/api/routers/         │
                │        ingestion.py           │
                └──────────────┬────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [ Validate Envelope ]             [ Deduplicate Event ]
  src/lad/contracts/validation.py   src/lad/adapters/local/store_sqlite.py
               │                               │
               ▼                               ▼
     (Partial Rejections)             (processed_events table)
               │                               │
               └───────────────┬───────────────┘
                               │ (New & Valid Events)
                               ▼
                ┌───────────────────────────────┐
                │ src/lad/adapters/local/       │
                │         queue_fs.py           │
                └──────────────┬────────────────┘
                               │ Writes atomic .json
                               ▼
                        [ data/queue/*.json ]
                               │
                               │ (Consumed asynchronously by worker)
                               ▼
                   [ Future Detection Worker ]
                               │
                               │ Discovers Anomaly & Hypotheses
                               ▼
                ┌───────────────────────────────┐
                │   StorePort.put_incident()    │
                └──────────────┬────────────────┘
                               │
                               ▼
                      [ data/lad.sqlite3 ]
                        (incidents table)
                               ▲
                               │
                               │ GET /api/v1/incidents
                               │ POST /api/v1/incidents/{id}/acknowledge
                               │ POST /api/v1/incidents/{id}/resolve
                               │ (Bearer: Admin)
                               │
                ┌──────────────┴────────────────┐
                │ services/api/routers/         │
                │        incidents.py           │
                └───────────────────────────────┘
                               ▲
                               │
                      [ Admin / Dashboard ]
```

---

## 6. Development Workflow Cheat Sheet

```bash
# 1. Environment Setup
make setup
cp .env.example .env
# Edit .env and supply distinct tokens:
# LAD_COLLECTOR_TOKEN=my-collector-secret
# LAD_ADMIN_TOKEN=my-admin-secret

# 2. Seed Demo Data (populates data/lad.sqlite3 with 3 incidents)
make seed

# 3. Start Local API Server (port 8080)
make local-up

# 4. Run Quality & Contract Verification
make lint       # ruff code analysis
make test       # full pytest suite
make contract   # fixture validation, OpenAPI linting, and parity tests
make smoke      # real ephemeral HTTP server smoke test
```
