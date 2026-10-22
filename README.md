# Log Anomaly Detector — API service (local lane)

FastAPI backend for ingesting normalized log events and serving anomaly
incidents. The JSON Schema and OpenAPI documents in `contracts/` are the
authoritative contract; tests enforce code/contract parity.

## Layout

```
src/lad/contracts/     Pydantic mirrors + JSON Schema validation (no HTTP)
src/lad/ports/         Interfaces: queue, store, clock
src/lad/adapters/local Concrete local implementations (files, SQLite)
services/api/          FastAPI app: config, auth, errors, routers
tests/                 API, adapter, and contract tests
scripts/               Fixture validator used by `make contract`
contracts/             Canonical schemas, OpenAPI, fixtures, ADR
```

This split keeps `src/lad` free of FastAPI/AWS imports so the same logic can run
inside a worker. `services/api` injects concrete adapters at startup
(`build_app(store=..., queue=...)`).

## Quickstart

```bash
make setup                       # .venv + editable install with dev extras
cp .env.example .env             # then set real tokens in .env
make local-up                    # http://127.0.0.1:8080
```

`LAD_COLLECTOR_TOKEN` and `LAD_ADMIN_TOKEN` are required and must differ.

## Endpoints

| Method | Path | Role |
|---|---|---|
| GET | `/api/v1/health` | none |
| POST | `/api/v1/events/batch` | collector |
| GET | `/api/v1/incidents` | admin |
| GET | `/api/v1/incidents/{id}` | admin |
| POST | `/api/v1/incidents/{id}/acknowledge` | admin |
| POST | `/api/v1/incidents/{id}/resolve` | admin |

Example:

```bash
jq '{events: [.]}' contracts/fixtures/valid/http_5xx.json > /tmp/batch.json
curl -s -X POST http://127.0.0.1:8080/api/v1/events/batch \
  -H "Authorization: Bearer $LAD_COLLECTOR_TOKEN" \
  -H "Content-Type: application/json" --data @/tmp/batch.json
```

## Behavior guarantees

- **Partial acceptance:** each event is validated independently. Invalid events
  are rejected with a reason; valid ones in the same batch are still accepted.
- **`202` means queued, not analyzed.** Detection runs asynchronously.
- **Idempotency:** `event_id` is the dedupe key. A duplicate returns
  `accepted` with `detail: "already accepted"` and is not enqueued twice.
- **Limits:** 1–100 events and max 256 KiB per request (HTTP 413 for oversized).
- **Auth boundaries:** missing/bad token → 401; wrong role → 403.
- **Errors:** always `{"error": {"code", "message", "request_id", "details?"}}`
  per `contracts/schemas/api-errors.schema.json`.
- **Lifecycle:** acknowledge/resolve are idempotent and append audit entries;
  no silent mutations.

## Checks

```bash
make lint       # ruff (undefined names, unused imports, import order)
make test       # lint + full pytest suite
make contract   # lint + fixture validation + OpenAPI validation + contract tests
```

## Notes for the next service (worker)

- Re-validate queued events; the queue is at-least-once.
- Persist incidents through `StorePort.put_incident`, which validates against
  `incident.schema.json`.
- Keep timestamps timezone-aware; `event_ts`/`observed_ts` must include UTC.
